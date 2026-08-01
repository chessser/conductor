import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { JiraIssueJson } from './jira-mapping.ts';

/**
 * A minimal, in-process stand-in for the slice of the Jira Cloud REST API
 * v3 that createJiraClient (jira.ts) actually calls: search, get, label
 * update, and comment. This is what CI runs against instead of a real
 * Jira instance — see docs/testing.md for why, and for the optional free
 * Atlassian Cloud sandbox to use for manual/local end-to-end checks
 * beyond what this fake can cover (real auth, real JQL parsing, etc).
 *
 * Not a general-purpose Jira mock — it only implements enough surface for
 * this app's own request shapes, and intentionally does not validate JQL.
 */
export interface FakeJiraServer {
  url: string;
  /** Every request this server has received, for test assertions. */
  requests: Array<{ method: string; path: string; body: unknown }>;
  close(): Promise<void>;
}

export interface FakeJiraServerOptions {
  /** Issues returned by /search/jql, keyed by nothing in particular — all are returned regardless of jql. */
  issues?: JiraIssueJson[];
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return undefined;
  return JSON.parse(raw);
}

export async function startFakeJiraServer(options: FakeJiraServerOptions = {}): Promise<FakeJiraServer> {
  const issues = new Map<string, JiraIssueJson>((options.issues ?? []).map((i) => [i.key, i]));
  const requests: FakeJiraServer['requests'] = [];
  let nextIssueNumber = issues.size + 1;

  const server: Server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const body = await readBody(req).catch(() => undefined);
      requests.push({ method: req.method ?? 'GET', path: url.pathname, body });

      const issueMatch = url.pathname.match(/^\/rest\/api\/3\/issue\/([^/]+)(\/comment)?$/);

      if (req.method === 'POST' && url.pathname === '/rest/api/3/issue') {
        const fields = (body as { fields?: Record<string, unknown> } | undefined)?.fields ?? {};
        const project = fields.project as { key?: string } | undefined;
        const key = `${project?.key ?? 'FAKE'}-${nextIssueNumber++}`;
        const issueTypeName = (fields.issuetype as { name?: string } | undefined)?.name;
        const description = fields.description as string | undefined;
        const newIssue: JiraIssueJson = {
          key,
          fields: {
            summary: (fields.summary as string) ?? '',
            ...(description !== undefined && { description }),
            ...(issueTypeName !== undefined && { issuetype: { name: issueTypeName } }),
            labels: (fields.labels as string[]) ?? [],
          },
        };
        issues.set(key, newIssue);
        res.writeHead(201, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ key }));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/rest/api/3/search/jql') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ issues: [...issues.values()] }));
        return;
      }

      if (req.method === 'GET' && issueMatch && !issueMatch[2]) {
        const issue = issues.get(issueMatch[1] as string);
        if (!issue) {
          res.writeHead(404, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ errorMessages: ['issue not found'] }));
          return;
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(issue));
        return;
      }

      if (req.method === 'PUT' && issueMatch && !issueMatch[2]) {
        const issue = issues.get(issueMatch[1] as string);
        const fields = (body as { fields?: Partial<JiraIssueJson['fields']> } | undefined)?.fields;
        if (issue && fields) {
          issue.fields = { ...issue.fields, ...fields };
        }
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method === 'POST' && issueMatch && issueMatch[2] === '/comment') {
        res.writeHead(201, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ id: '1' }));
        return;
      }

      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ errorMessages: [`no fake route for ${req.method} ${url.pathname}`] }));
    })();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

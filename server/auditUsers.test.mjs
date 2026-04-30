import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("unblockAuditClientForMaster remove bloqueio e tentativas do IP informado", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "consulta-cnpj-audit-"));
  const usersPath = path.join(tempDir, "audit-users.json");
  const previousUsersPath = process.env.AUDIT_USERS_PATH;

  process.env.AUDIT_USERS_PATH = usersPath;

  try {
    await writeFile(
      usersPath,
      `${JSON.stringify(
        {
          users: [],
          blockedClients: [
            { ip: "10.0.0.20", reason: "token_failed_3_times", attempts: 3, blockedAt: "2026-04-30T10:00:00.000Z" },
            { ip: "10.0.0.30", reason: "token_failed_3_times", attempts: 3, blockedAt: "2026-04-30T10:05:00.000Z" }
          ],
          failedAttempts: [
            { ip: "10.0.0.20", attempts: 3, lastAttemptAt: "2026-04-30T10:00:00.000Z" },
            { ip: "10.0.0.30", attempts: 2, lastAttemptAt: "2026-04-30T10:05:00.000Z" }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const { unblockAuditClientForMaster } = await import(`./auditUsers.mjs?test=${Date.now()}`);
    const result = await unblockAuditClientForMaster({ user: { role: "master" } }, { ip: "10.0.0.20" });
    const stored = JSON.parse(await readFile(usersPath, "utf8"));

    assert.equal(result.ip, "10.0.0.20");
    assert.equal(result.removedBlocked, 1);
    assert.equal(result.removedFailures, 1);
    assert.deepEqual(stored.blockedClients.map((client) => client.ip), ["10.0.0.30"]);
    assert.deepEqual(stored.failedAttempts.map((attempt) => attempt.ip), ["10.0.0.30"]);
  } finally {
    if (previousUsersPath === undefined) {
      delete process.env.AUDIT_USERS_PATH;
    } else {
      process.env.AUDIT_USERS_PATH = previousUsersPath;
    }

    await rm(tempDir, { recursive: true, force: true });
  }
});

test("unblockAuditClientForMaster exige perfil master e IP", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "consulta-cnpj-audit-"));
  const usersPath = path.join(tempDir, "audit-users.json");
  const previousUsersPath = process.env.AUDIT_USERS_PATH;

  process.env.AUDIT_USERS_PATH = usersPath;

  try {
    const { unblockAuditClientForMaster } = await import(`./auditUsers.mjs?test=${Date.now()}`);

    assert.equal(await unblockAuditClientForMaster({ user: { role: "viewer" } }, { ip: "10.0.0.20" }), null);
    await assert.rejects(
      () => unblockAuditClientForMaster({ user: { role: "master" } }, { ip: "" }),
      /Informe o IP/
    );
  } finally {
    if (previousUsersPath === undefined) {
      delete process.env.AUDIT_USERS_PATH;
    } else {
      process.env.AUDIT_USERS_PATH = previousUsersPath;
    }

    await rm(tempDir, { recursive: true, force: true });
  }
});

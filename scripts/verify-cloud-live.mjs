// Run only with temporary synthetic users in the dedicated project. Credentials
// arrive as one JSON line over stdin; they are never printed or written to disk.
import { createInterface } from "node:readline";
import { createHash, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
const rl = createInterface({ input: process.stdin, terminal: false });
console.log(
  "Ready for synthetic fixture JSON on stdin (input must be hidden).",
);
const fixture = await new Promise((resolve) =>
  rl.once("line", (line) => {
    rl.close();
    resolve(JSON.parse(line));
  }),
);
const url = "https://jazinwkendlnctjnmwuf.supabase.co";
const key = "sb_publishable_zD184654nCHPSumAfRdOMA_nyxqWhLw";
const client = () =>
  createClient(url, key, {
    auth: {
      storageKey: "fixture-" + randomUUID(),
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(20000) }),
    },
  });
const a = client(),
  device2 = client(),
  b = client(),
  anon = client();
const signIn = async (c, id) => {
  const { data, error } = await c.auth.signInWithPassword({
    email: `qa-${id}@example.invalid`,
    password: fixture.password,
  });
  if (error) throw new Error("Synthetic auth failed: " + error.message);
  assert.equal(data.user.id, id);
};
await signIn(a, fixture.a);
console.log("Session A ready");
await signIn(device2, fixture.a);
console.log("Second device ready");
await signIn(b, fixture.b);
console.log("Other account ready");
const bytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=",
  "base64",
);
const hash = createHash("sha256").update(bytes).digest("hex");
const path = fixture.a + "/" + hash;
const store = a.storage.from("journal-files");
try {
  await store.remove([path]);
  const initial = await a
    .from("journal_states")
    .select("revision")
    .maybeSingle();
  if (initial.error) throw initial.error;
  const revision = initial.data?.revision || 0;
  const upload = await store.upload(path, bytes, {
    contentType: "image/png",
    upsert: false,
  });
  assert.equal(upload.error, null, upload.error?.message);
  console.log("Private attachment uploaded");
  const entry = {
    id: randomUUID(),
    kind: "photo",
    title: "Synthetic cross-device verification",
    date: "2026-11-09",
    notes: "No personal data",
    fields: {},
    treatmentId: "",
    metrics: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    attachments: [
      {
        id: randomUUID(),
        name: "sample.png",
        type: "image/png",
        size: bytes.length,
        path,
      },
    ],
  };
  const saved = await a.rpc("save_journal", {
    expected_revision: revision,
    new_entries: [entry],
  });
  assert.equal(saved.error, null, saved.error?.message);
  assert.equal(saved.data, revision + 1);
  console.log("Revision saved");
  const read = await device2
    .from("journal_states")
    .select("revision,entries")
    .single();
  assert.equal(read.error, null, read.error?.message);
  assert.deepEqual(read.data.entries, [entry]);
  console.log("Second device metadata matched");
  const download = await device2.storage.from("journal-files").download(path);
  assert.equal(download.error, null, download.error?.message);
  assert.equal(
    createHash("sha256")
      .update(Buffer.from(await download.data.arrayBuffer()))
      .digest("hex"),
    hash,
  );
  console.log("Second device file hash matched");
  const denied = await b.from("journal_states").select("*");
  assert.equal(denied.error, null);
  assert.equal(denied.data.length, 0);
  assert.ok((await b.storage.from("journal-files").download(path)).error);
  assert.ok((await anon.from("journal_states").select("*")).error);
  assert.ok((await anon.storage.from("journal-files").download(path)).error);
  const conflict = await device2.rpc("save_journal", {
    expected_revision: 0,
    new_entries: [],
  });
  assert.equal(
    conflict.error?.code,
    "PT409",
    JSON.stringify({ status: conflict.status, error: conflict.error }),
  );
  const publicRead = await fetch(
    url + "/storage/v1/object/public/journal-files/" + path,
  );
  assert.notEqual(publicRead.status, 200);
  console.log(
    JSON.stringify({
      sameAccountTwoSessions: true,
      privateAttachmentRoundTrip: true,
      crossUserDenied: true,
      anonymousDenied: true,
      publicUrlDenied: true,
      staleWriteDenied: true,
    }),
  );
} finally {
  const removed = await store.remove([path]);
  if (removed.error)
    throw new Error("Synthetic file cleanup failed: " + removed.error.message);
  await Promise.all([
    a.auth.signOut(),
    device2.auth.signOut(),
    b.auth.signOut(),
  ]);
}

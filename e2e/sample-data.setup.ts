import { test as setup } from "@playwright/test";

import { resetSampleData } from "./admin/helpers";

// Before any spec: puts the local database back to the seed and the sample
// staff list, whatever the database tests or a dev session left in it. The
// route refuses a database that isn't local (403), so this fails loudly
// against a reused dev server pointed anywhere else.
setup("starts from the sample data", async ({ request }) => {
  await resetSampleData(request);
});

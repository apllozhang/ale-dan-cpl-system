import { router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import { authRouter } from "./routers/auth";
import { organizationsRouter } from "./routers/organizations";
import { userGroupsRouter } from "./routers/userGroups";
import { usersRouter } from "./routers/users";
import { quotationsRouter } from "./routers/quotations";
import { cplRouter } from "./routers/cpl";
import { importLogsRouter } from "./routers/importLogs";
import { activityLogsRouter } from "./routers/activityLogs";
import { templatesRouter } from "./routers/templates";
import { versionsRouter } from "./routers/versions";
import { sharingRouter } from "./routers/sharing";
import { searchesRouter } from "./routers/searches";
import { suggestionsRouter } from "./routers/suggestions";
import { productSpecsRouter } from "./routers/productSpecs";
import { customersRouter } from "./routers/customers";
import { certificationsRouter } from "./routers/certifications";
import { eflashRouter } from "./routers/eflash";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  organizations: organizationsRouter,
  userGroups: userGroupsRouter,
  users: usersRouter,
  quotations: quotationsRouter,
  cpl: cplRouter,
  importLogs: importLogsRouter,
  activityLogs: activityLogsRouter,
  templates: templatesRouter,
  versions: versionsRouter,
  sharing: sharingRouter,
  searches: searchesRouter,
  suggestions: suggestionsRouter,
  productSpecs: productSpecsRouter,
  customers: customersRouter,
  certifications: certificationsRouter,
  eflash: eflashRouter,
});

export type AppRouter = typeof appRouter;

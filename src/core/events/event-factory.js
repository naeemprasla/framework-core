import { newId } from "../ids/id.js";
export function createEvent(type, data, context={}) { return { id:newId("evt"), type, version:1, occurred_at:new Date().toISOString(), correlation_id:context.correlationId??null, causation_id:context.causationId??null, app_id:context.appId??null, tenant_id:context.tenantId??null, actor_id:context.accountId??null, data }; }

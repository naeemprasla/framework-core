const service = {
  module: "workflow",
  async execute(input, context={}) { return { ok:true, module:"workflow", input, context:{appId:context.appId??null,tenantId:context.tenantId??null} }; }
};
export default {
  async register(ctx) {
    ctx.capabilities.register("workflow.transition.execute", service, { owner:"framework.workflow" });
    ctx.health.register("module:framework.workflow", async()=>({ok:true}), {critical:false});
  },
  async boot() {},
  async health() { return {status:"healthy"}; }
};

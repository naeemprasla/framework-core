const service = {
  module: "access",
  async execute(input, context={}) { return { ok:true, module:"access", input, context:{appId:context.appId??null,tenantId:context.tenantId??null} }; }
};
export default {
  async register(ctx) {
    ctx.capabilities.register("access.permission.check", service, { owner:"framework.access" });
    ctx.health.register("module:framework.access", async()=>({ok:true}), {critical:false});
  },
  async boot() {},
  async health() { return {status:"healthy"}; }
};

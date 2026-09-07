const service = {
  module: "email",
  async execute(input, context={}) { return { ok:true, module:"email", input, context:{appId:context.appId??null,tenantId:context.tenantId??null} }; }
};
export default {
  async register(ctx) {
    ctx.capabilities.register("communication.email.send", service, { owner:"framework.email" });
    ctx.health.register("module:framework.email", async()=>({ok:true}), {critical:false});
  },
  async boot() {},
  async health() { return {status:"healthy"}; }
};

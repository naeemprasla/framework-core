const service = {
  module: "billing",
  async execute(input, context={}) { return { ok:true, module:"billing", input, context:{appId:context.appId??null,tenantId:context.tenantId??null} }; }
};
export default {
  async register(ctx) {
    ctx.capabilities.register("commerce.payment.create", service, { owner:"framework.billing" });
    ctx.health.register("module:framework.billing", async()=>({ok:true}), {critical:false});
  },
  async boot() {},
  async health() { return {status:"healthy"}; }
};

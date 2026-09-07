const service = {
  module: "messaging",
  async execute(input, context={}) { return { ok:true, module:"messaging", input, context:{appId:context.appId??null,tenantId:context.tenantId??null} }; }
};
export default {
  async register(ctx) {
    ctx.capabilities.register("messaging.message.send", service, { owner:"framework.messaging" });
    ctx.health.register("module:framework.messaging", async()=>({ok:true}), {critical:false});
  },
  async boot() {},
  async health() { return {status:"healthy"}; }
};

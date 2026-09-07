const service = {
  module: "notifications",
  async execute(input, context={}) { return { ok:true, module:"notifications", input, context:{appId:context.appId??null,tenantId:context.tenantId??null} }; }
};
export default {
  async register(ctx) {
    ctx.capabilities.register("communication.notification.send", service, { owner:"framework.notifications" });
    ctx.health.register("module:framework.notifications", async()=>({ok:true}), {critical:false});
  },
  async boot() {},
  async health() { return {status:"healthy"}; }
};

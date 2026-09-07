const service = {
  module: "content",
  async execute(input, context={}) { return { ok:true, module:"content", input, context:{appId:context.appId??null,tenantId:context.tenantId??null} }; }
};
export default {
  async register(ctx) {
    ctx.capabilities.register("content.entity.manage", service, { owner:"framework.content" });
    ctx.health.register("module:framework.content", async()=>({ok:true}), {critical:false});
  },
  async boot() {},
  async health() { return {status:"healthy"}; }
};

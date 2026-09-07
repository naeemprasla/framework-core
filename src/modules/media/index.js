const service = {
  module: "media",
  async execute(input, context={}) { return { ok:true, module:"media", input, context:{appId:context.appId??null,tenantId:context.tenantId??null} }; }
};
export default {
  async register(ctx) {
    ctx.capabilities.register("media.file.store", service, { owner:"framework.media" });
    ctx.health.register("module:framework.media", async()=>({ok:true}), {critical:false});
  },
  async boot() {},
  async health() { return {status:"healthy"}; }
};

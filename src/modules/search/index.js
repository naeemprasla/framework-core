const service = {
  module: "search",
  async execute(input, context={}) { return { ok:true, module:"search", input, context:{appId:context.appId??null,tenantId:context.tenantId??null} }; }
};
export default {
  async register(ctx) {
    ctx.capabilities.register("search.query", service, { owner:"framework.search" });
    ctx.health.register("module:framework.search", async()=>({ok:true}), {critical:false});
  },
  async boot() {},
  async health() { return {status:"healthy"}; }
};

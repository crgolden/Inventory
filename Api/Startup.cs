namespace Inventory
{
    using Controllers;
    using Core;
    using Core.Filters;
    using Microsoft.AspNet.OData;
    using Microsoft.AspNet.OData.Builder;
    using Microsoft.AspNet.OData.Extensions;
    using Microsoft.AspNetCore.Builder;
    using Microsoft.AspNetCore.Hosting;
    using Microsoft.Extensions.Configuration;
    using Microsoft.Extensions.DependencyInjection;
    using Microsoft.Extensions.Hosting;
    using static Microsoft.AspNet.OData.Query.AllowedQueryOptions;
    using static Microsoft.AspNetCore.Mvc.CompatibilityVersion;
    using static Microsoft.OData.ODataUrlKeyDelimiter;

    public class Startup
    {
        private readonly IWebHostEnvironment _environment;
        private readonly IConfigurationSection _mediatRSection;
        private readonly IConfigurationSection _mongoSection;
        private readonly IConfigurationSection _swaggerSection;

        public Startup(IConfiguration configuration, IWebHostEnvironment environment)
        {
            _environment = environment;
            _mediatRSection = configuration.GetMediatROptionsSection();
            _mongoSection = configuration.GetMongoDataOptionsSection();
            _swaggerSection = configuration.GetSwaggerOptionsSection();
        }

        // This method gets called by the runtime. Use this method to add services to the container.
        public void ConfigureServices(IServiceCollection services)
        {
            services.AddMvc(options =>
            {
                options.EnableEndpointRouting = false;
                options.Filters.Add<ModelStateActionFilter>();
            }).SetCompatibilityVersion(Latest);
            services.AddMediatR(new[] { typeof(Asset) }, _mediatRSection, service => service.AsScoped());
            services.AddMongo(_mongoSection);
            services.AddSwagger(_swaggerSection);
            services.AddODataApiExplorer(options =>
            {
                var getAssetsMethod = typeof(AssetsController).GetMethod(nameof(AssetsController.GetAssets));
                options.QueryOptions.Controller<AssetsController>().Action(getAssetsMethod!).Allow(All).AllowTop(default);
            });
        }

        // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
        public void Configure(IApplicationBuilder app)
        {
            if (_environment.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
            }

            app.UseExceptionHandler(app1 => app1.Run(async context => await context.HandleException().ConfigureAwait(false)));
            app.UseHttpsRedirection();
            app.UseSwagger();
            app.UseSwaggerUI();
            app.UseAuthentication();
            app.UseAuthorization();
            app.UseMvc(routeBuilder =>
            {
                var options = routeBuilder.ServiceProvider.GetRequiredService<ODataOptions>();
                options.UrlKeyDelimiter = Parentheses;
                var modelBuilder = routeBuilder.ServiceProvider.GetRequiredService<VersionedODataModelBuilder>();
                routeBuilder.MapVersionedODataRoutes("odata", "api/v{version:apiVersion}", modelBuilder.GetEdmModels());
            });
        }
    }
}

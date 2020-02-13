namespace Inventory
{
    using System;
    using System.Diagnostics.CodeAnalysis;
    using Controllers;
    using Core.Filters;
    using MediatR;
    using Microsoft.AspNet.OData;
    using Microsoft.AspNet.OData.Builder;
    using Microsoft.AspNet.OData.Extensions;
    using Microsoft.AspNetCore.Authorization;
    using Microsoft.AspNetCore.Builder;
    using Microsoft.AspNetCore.Hosting;
    using Microsoft.AspNetCore.Http;
    using Microsoft.Extensions.Caching.Memory;
    using Microsoft.Extensions.Configuration;
    using Microsoft.Extensions.DependencyInjection;
    using Microsoft.Extensions.Hosting;
    using Microsoft.Extensions.Options;
    using Notifications;
    using StackExchange.Redis;
    using static System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler;
    using static Microsoft.AspNet.OData.Query.AllowedQueryOptions;
    using static Microsoft.AspNetCore.Mvc.CompatibilityVersion;
    using static Microsoft.OData.ODataUrlKeyDelimiter;
    using static StackExchange.Redis.ConnectionMultiplexer;

    public class Startup
    {
        private readonly IWebHostEnvironment _environment;
        private readonly IConfigurationSection _mediatRSection;
        private readonly IConfigurationSection _mongoSection;
        private readonly IConfigurationSection _swaggerSection;
        private readonly IConfigurationSection _distributedCacheEntryOptionsSection;
        private readonly IConfigurationSection _redisOptionsSection;
        private readonly string _authority;
        private readonly string _audience;

        public Startup(IConfiguration configuration, IWebHostEnvironment environment)
        {
            if (configuration == default)
            {
                throw new ArgumentNullException(nameof(configuration));
            }

            _environment = environment ?? throw new ArgumentNullException(nameof(environment));
            _mediatRSection = configuration.GetMediatROptionsSection();
            _mongoSection = configuration.GetMongoDataOptionsSection();
            _swaggerSection = configuration.GetSwaggerOptionsSection();
            _distributedCacheEntryOptionsSection = configuration.GetSection(nameof(MemoryCacheEntryOptions));
            _authority = configuration.GetValue<string>("Authority");
            _audience = configuration.GetValue<string>("Audience");
            _redisOptionsSection = configuration.GetSection("RedisOptions");
        }

        // This method gets called by the runtime. Use this method to add services to the container.
        [SuppressMessage("Design", "ASP0000:Do not call 'IServiceCollection.BuildServiceProvider' in 'ConfigureServices'", Justification = "Forces configs and validations to run")]
        public void ConfigureServices(IServiceCollection services)
        {
            DefaultInboundClaimTypeMap.Clear();
            DefaultOutboundClaimTypeMap.Clear();
            services.AddApplicationInsightsTelemetry(options =>
            {
            });
            services.AddMvc(options =>
            {
                options.EnableEndpointRouting = false;
                options.Filters.Add<ModelStateActionFilter>();
            }).SetCompatibilityVersion(Latest);
            services.Configure<RedisOptions>(_redisOptionsSection);
            services.AddSingleton<IConnectionMultiplexer>(sp =>
            {
                var redisOptions = sp.GetRequiredService<IOptions<RedisOptions>>().Value;
                var options = new ConfigurationOptions
                {
                    Password = redisOptions.Password
                };
                options.EndPoints.Add(redisOptions.Host, redisOptions.Port);
                return Connect(options);
            });
            services.AddMemoryCache(options =>
            {
            });
            services.Configure<MemoryCacheEntryOptions>(_distributedCacheEntryOptionsSection);
            services.AddMediatR(new[] { typeof(Asset) }, _mediatRSection, service => service.AsScoped());
            services.AddScoped<IRequestHandler<Requests.GetRequest<Asset>, Asset>, RequestHandlers.RequestHandler<Asset>>();
            services.AddScoped<INotificationHandler<CreateNotification<Asset>>, NotificationHandlers.NotificationHandler<Asset>>();
            services.AddScoped<INotificationHandler<UpdateNotification<Asset>>, NotificationHandlers.NotificationHandler<Asset>>();
            services.AddScoped<INotificationHandler<DeleteNotification>, NotificationHandlers.NotificationHandler<Asset>>();
            services.AddMongo(_mongoSection);
            services.AddSwagger(_swaggerSection);
            services.AddODataApiExplorer(options =>
            {
                var getAssetsMethod = typeof(AssetsController).GetMethod(nameof(AssetsController.GetAssets));
                options.QueryOptions.Controller<AssetsController>().Action(getAssetsMethod!).Allow(All).AllowTop(default);
            });
            services.AddAuthentication().AddJwtBearer(options =>
            {
                options.Authority = _authority;
                options.Audience = _audience;
            });
            services.AddAuthorization(options =>
            {
                var createdByRequirement = new CreatedByRequirement<Asset, Guid>();
                options.AddPolicy(nameof(AssetController.GetAsset), config =>
                {
                    config.Requirements.Add(createdByRequirement);
                });
                options.AddPolicy(nameof(AssetController.PatchAsset), config =>
                {
                    config.Requirements.Add(createdByRequirement);
                });
                options.AddPolicy(nameof(AssetController.PutAsset), config =>
                {
                    config.Requirements.Add(createdByRequirement);
                });
                options.AddPolicy(nameof(AssetController.DeleteAsset), config =>
                {
                    config.Requirements.Add(createdByRequirement);
                });
            });
            services.AddScoped<IAuthorizationHandler, AuthorizationHandler<Asset, Guid>>();
            services.AddHealthChecks();
        }

        // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
        public void Configure(IApplicationBuilder app)
        {
            if (_environment.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
            }

            app.UseStaticFiles();
            app.UseExceptionHandler(app1 => app1.Run(async context => await context.HandleException().ConfigureAwait(false)));
            app.UseHttpsRedirection();
            app.UseHealthChecks("/health");
            app.UseSwagger();
            app.UseSwaggerUI(options =>
            {
                options.InjectJavascript("setToken.js");
            });
            app.UseAuthentication();
            app.UseAuthorization();
            app.UseApiVersioning();
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

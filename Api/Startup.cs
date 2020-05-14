namespace Inventory
{
    using System;
    using System.Text.Json.Serialization;
    using Authorization;
    using Controllers;
    using Core.Converters;
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
            _redisOptionsSection = configuration.GetSection(nameof(RedisOptions));
            _authority = configuration.GetValue<string>("Authority");
            _audience = configuration.GetValue<string>("Audience");
        }

        // This method gets called by the runtime. Use this method to add services to the container.
        public void ConfigureServices(IServiceCollection services)
        {
            DefaultInboundClaimTypeMap.Clear();
            DefaultOutboundClaimTypeMap.Clear();
            services.AddApplicationInsightsTelemetry(options =>
            {
            });
            services.AddMvc(setupAction =>
            {
                setupAction.EnableEndpointRouting = false;
                setupAction.Filters.Add<ModelStateActionFilter>();
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
            services.AddMemoryCache(setupAction =>
            {
            });
            services.Configure<MemoryCacheEntryOptions>(_distributedCacheEntryOptionsSection);
            services.AddMediatR(new[] { typeof(Asset) }, _mediatRSection, configureService => configureService.AsScoped());
            services.AddScoped<INotificationHandler<CreateNotification<Asset, Guid>>, NotificationHandlers.NotificationHandler<Asset, Guid>>();
            services.AddScoped<INotificationHandler<CreateRangeNotification<Asset, Guid>>, NotificationHandlers.NotificationHandler<Asset, Guid>>();
            services.AddScoped<INotificationHandler<UpdateNotification<Asset, Guid>>, NotificationHandlers.NotificationHandler<Asset, Guid>>();
            services.AddScoped<INotificationHandler<UpdateRangeNotification<Asset, Guid>>, NotificationHandlers.NotificationHandler<Asset, Guid>>();
            services.AddScoped<INotificationHandler<DeleteNotification<Guid>>, NotificationHandlers.NotificationHandler<Asset, Guid>>();
            services.AddScoped<INotificationHandler<DeleteRangeNotification<Guid>>, NotificationHandlers.NotificationHandler<Asset, Guid>>();
            services.AddScoped<INotificationHandler<GetRangeNotification<Asset, Guid>>, NotificationHandlers.NotificationHandler<Asset, Guid>>();
            services.AddSingleton(typeof(JsonConverter<>), typeof(JsonElementConverter<>));
            services.AddMongo(_mongoSection);
            services.AddSwagger(_swaggerSection);
            services.AddODataApiExplorer(setupAction =>
            {
                var getAssetsMethod = typeof(AssetsController).GetMethod(nameof(AssetsController.GetAssets));
                setupAction.QueryOptions.Controller<AssetsController>().Action(getAssetsMethod!).Allow(All).AllowTop(default);
            });
            services.AddAuthentication().AddJwtBearer(configureOptions =>
            {
                configureOptions.Authority = _authority;
                configureOptions.Audience = _audience;
            });
            services.AddAuthorization(configure =>
            {
                var createdByRequirement = new CreatedByRequirement<Asset, Guid, Guid>(nameof(MongoDB), new[] { "Admin" });
                configure.AddPolicy(nameof(AssetController.GetAsset), config =>
                {
                    config.Requirements.Add(createdByRequirement);
                });
                configure.AddPolicy(nameof(AssetController.PatchAsset), config =>
                {
                    config.Requirements.Add(createdByRequirement);
                });
                configure.AddPolicy(nameof(AssetController.PutAsset), config =>
                {
                    config.Requirements.Add(createdByRequirement);
                });
                configure.AddPolicy(nameof(AssetController.DeleteAsset), config =>
                {
                    config.Requirements.Add(createdByRequirement);
                });
                configure.AddPolicy(nameof(AssetsController.PostAssets), config =>
                {
                    config.Requirements.Add(createdByRequirement);
                });
                configure.AddPolicy(nameof(AssetsController.PutAssets), config =>
                {
                    config.Requirements.Add(createdByRequirement);
                });
                configure.AddPolicy(nameof(AssetsController.DeleteAssets), config =>
                {
                    config.Requirements.Add(createdByRequirement);
                });
            });
            services.AddScoped<IAuthorizationHandler, CreatedByRequirementHandler<Asset, Guid, Guid>>();
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
            app.UseSwaggerUI(setupAction =>
            {
                setupAction.InjectJavascript("setToken.js");
            });
            app.UseAuthentication();
            app.UseAuthorization();
            app.UseApiVersioning();
            app.UseMvc(configureRoutes =>
            {
                var options = configureRoutes.ServiceProvider.GetRequiredService<ODataOptions>();
                options.UrlKeyDelimiter = Parentheses;
                var modelBuilder = configureRoutes.ServiceProvider.GetRequiredService<VersionedODataModelBuilder>();
                configureRoutes.MapVersionedODataRoutes("odata", "api/v{version:apiVersion}", modelBuilder.GetEdmModels());
            });
        }
    }
}

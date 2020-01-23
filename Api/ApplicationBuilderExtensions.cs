namespace Assets
{
    using System;
    using System.Collections.Generic;
    using System.Diagnostics.CodeAnalysis;
    using System.Threading.Tasks;
    using Common;
    using Microsoft.AspNetCore.Builder;
    using Microsoft.AspNetCore.Diagnostics;
    using Microsoft.AspNetCore.Http;
    using Microsoft.AspNetCore.Mvc;
    using Microsoft.AspNetCore.Mvc.Abstractions;
    using Microsoft.AspNetCore.Mvc.Infrastructure;
    using Microsoft.AspNetCore.Routing;
    using Microsoft.Extensions.DependencyInjection;
    using Microsoft.Extensions.Logging;
    using Microsoft.OData;
    using static System.StringComparer;
    using static System.Threading.Tasks.Task;
    using static Microsoft.AspNetCore.Http.StatusCodes;
    using static Microsoft.AspNetCore.WebUtilities.ReasonPhrases;
    using static Microsoft.Net.Http.Headers.HeaderNames;

    public static class ApplicationBuilderExtensions
    {
        private static readonly HashSet<string> CorsHeaderNames = new HashSet<string>(OrdinalIgnoreCase)
        {
            AccessControlAllowCredentials,
            AccessControlAllowHeaders,
            AccessControlAllowMethods,
            AccessControlAllowOrigin,
            AccessControlExposeHeaders,
            AccessControlMaxAge
        };

        [SuppressMessage("StyleCop.CSharp.NamingRules", "SA1305:Field names should not use Hungarian notation", Justification = "oData")]
        public static Task HandleException(this IApplicationBuilder app, HttpContext context)
        {
            if (app == default)
            {
                throw new ArgumentNullException(nameof(app));
            }

            if (context == default)
            {
                throw new ArgumentNullException(nameof(context));
            }

            if (context.Response.HasStarted)
            {
                return CompletedTask;
            }

            var details = new ProblemDetails
            {
                Status = context.Response.StatusCode,
                Type = $"https://httpstatuses.com/{context.Response.StatusCode}",
                Title = GetReasonPhrase(context.Response.StatusCode)
            };

            var exceptionHandlerPathFeature = context.Features.Get<IExceptionHandlerPathFeature>();
            if (exceptionHandlerPathFeature?.Error != default)
            {
                var logger = app.ApplicationServices.GetRequiredService<ILogger<HttpContext>>();
                logger.LogError(EventIds.Exception, exceptionHandlerPathFeature.Error, default);
            }

            var routeData = context.GetRouteData() ?? new RouteData();
            ClearResponse(context);
            var actionContext = new ActionContext(context, routeData, new ActionDescriptor());
            var result = new ObjectResult(details)
            {
                StatusCode = details.Status,
                DeclaredType = typeof(ProblemDetails)
            };

            result.ContentTypes.Add("application/problem+json");
            result.ContentTypes.Add("application/problem+xml");

            var executor = app.ApplicationServices.GetRequiredService<IActionResultExecutor<ObjectResult>>();
            return executor.ExecuteAsync(actionContext, result);
        }

        private static void ClearResponse(HttpContext context)
        {
            var headers = new HeaderDictionary();

            // Make sure problem responses are never cached.
            headers.Append(CacheControl, "no-cache, no-store, must-revalidate");
            headers.Append(Pragma, "no-cache");
            headers.Append(Expires, "0");

            foreach (var header in context.Response.Headers)
            {
                // Because the CORS middleware adds all the headers early in the pipeline,
                // we want to copy over the existing Access-Control-* headers after resetting the response.
                if (CorsHeaderNames.Contains(header.Key))
                {
                    headers.Add(header);
                }
            }

            var statusCode = context.Response.StatusCode;
            context.Response.Clear();
            context.Response.StatusCode = statusCode;

            foreach (var header in headers)
            {
                context.Response.Headers.Add(header);
            }
        }
    }
}

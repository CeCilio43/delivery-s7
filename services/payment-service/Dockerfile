# Built from the repository root (see infra/docker-compose.yml), since the
# service depends on the shared libs/Delivery.Common project.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /repo
COPY Directory.Build.props global.json ./
COPY libs/Delivery.Common/ libs/Delivery.Common/
COPY services/payment-service/src/ services/payment-service/src/
RUN dotnet publish services/payment-service/src -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app ./
EXPOSE 3004
ENTRYPOINT ["dotnet", "PaymentService.dll"]

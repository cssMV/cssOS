const requiredEnv = ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"];

function appBaseUrl() {
  return (
    process.env.APP_BASE_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.PUBLIC_BASE_URL ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

function main() {
  const missingEnv = requiredEnv.filter((key) => !process.env[key]);
  const baseUrl = appBaseUrl();
  const report = {
    provider: "github",
    enabled: missingEnv.length === 0,
    missingEnv,
    startUrl: `${baseUrl}/auth/github`,
    callbackUrl: `${baseUrl}/auth/github/callback`,
    apiStartUrl: `${baseUrl}/api/auth/github`,
    nextStep:
      missingEnv.length === 0
        ? "GitHub OAuth config looks ready. Open startUrl in a browser to verify redirect."
        : "Add the missing GitHub env vars, then retry this check."
  };

  console.log(JSON.stringify(report, null, 2));

  if (missingEnv.length > 0) {
    process.exitCode = 1;
  }
}

main();

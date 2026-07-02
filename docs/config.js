window.APP_CONFIG = {
  brandName: "AI星球",
  logoPath: "./assets/ai-planet-logo.jpg",
  submissionEndpoint: window.location.hostname.endsWith(".github.io")
    ? "https://ai-planet-coaching.pages.dev/api/submissions"
    : "/api/submissions",
};

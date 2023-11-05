const url = "https://raw.githubusercontent.com/sengshinlee/hosts/main/hosts";

addEventListener("fetch", (event) => {
  return event.respondWith(handleRequest());
});

async function handleRequest() {
  const init = { headers: { "content-type": "text/plain; charset=utf-8" } };
  const response = await fetch(url, init);
  const results = await gatherResponse(response);
  return new Response(results, init);
}

async function gatherResponse(response) {
  const { headers } = response;
  const contentType = headers.get("content-type") || "";
  if (contentType.includes("text/plain")) {
    return response.text();
  }
}

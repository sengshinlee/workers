const DOMAIN = "sengshinlee.com";
const NOTION_SITE = "sengshinlee.notion.site";
const PAGE_TITLE_TO_PAGE_UUID = {
    "": "488db7166e9c49fab31ac2c0c62649b1",
};
const PAGE_UUID_TO_PAGE_TITLE = {};
const titles = [];
const uuids = [];

Object.keys(PAGE_TITLE_TO_PAGE_UUID).forEach((title) => {
    const uuid = PAGE_TITLE_TO_PAGE_UUID[title];
    titles.push(title);
    uuids.push(uuid);
    PAGE_UUID_TO_PAGE_TITLE[uuid] = title;
});

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

addEventListener("fetch", (event) => {
    event.respondWith(fetchAndApply(event.request));
});

async function fetchAndApply(request) {
    if (request.method === "OPTIONS") {
        return handleRequest(request);
    }

    let url = new URL(request.url);
    url.hostname = NOTION_SITE;

    let response;
    if (url.pathname.startsWith("/app") && url.pathname.endsWith("js")) {
        response = await fetch(url.toString());
        let body = await response.text();
        response = new Response(body.replace(/${NOTION_SITE}/g, DOMAIN), response);
        response.headers.set("content-type", "application/x-javascript");
        return response;
    } else if (url.pathname.startsWith("/api")) {
        response = await fetch(url.toString(), {
            body: url.pathname.startsWith("/api/v3/getPublicPageData") ? null : request.body,
            headers: {
                "content-type": "application/json; charset=UTF-8",
                "user-agent":
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.5359.124 Safari/537.36 Edg/108.0.1462.54",
            },
            method: "POST",
        });
        response = new Response(response.body, response);
        response.headers.set("Access-Control-Allow-Origin", "*");
        return response;
    } else if (titles.indexOf(url.pathname.slice(1)) > -1) {
        const PAGE_UUID = PAGE_TITLE_TO_PAGE_UUID[url.pathname.slice(1)];
        return Response.redirect("https://" + DOMAIN + "/" + PAGE_UUID, 301);
    } else if (uuids.indexOf(url.pathname.slice(1)) === -1 && url.pathname.slice(1).match(/[0-9a-f]{32}/)) {
        return Response.redirect("https://" + DOMAIN, 301);
    } else {
        response = await fetch(url.toString(), {
            body: request.body,
            headers: request.headers,
            method: request.method,
        });
        response = new Response(response.body, response);
        response.headers.delete("Content-Security-Policy");
        response.headers.delete("X-Content-Security-Policy");
    }

    return appendJavaScript(response, PAGE_TITLE_TO_PAGE_UUID);
}

function handleRequest(request) {
    if (
        request.headers.get("Origin") !== null &&
        request.headers.get("Access-Control-Request-Method") !== null &&
        request.headers.get("Access-Control-Request-Headers") !== null
    ) {
        return new Response(null, {
            headers: CORS_HEADERS,
        });
    } else {
        return new Response(null, {
            headers: {
                Allow: "GET, HEAD, POST, PUT, OPTIONS",
            },
        });
    }
}

async function appendJavaScript(res, PAGE_TITLE_TO_PAGE_UUID) {
    return new HTMLRewriter().on("body", new BodyRewriter(PAGE_TITLE_TO_PAGE_UUID)).transform(res);
}

class BodyRewriter {
    constructor(PAGE_TITLE_TO_PAGE_UUID) {
        this.PAGE_TITLE_TO_PAGE_UUID = PAGE_TITLE_TO_PAGE_UUID;
    }
    element(element) {
        element.append(`
        <script>
        window.CONFIG.domainBaseUrl = "https://${DOMAIN}";

        const PAGE_TITLE_TO_PAGE_UUID = ${
            JSON.stringify(this.PAGE_TITLE_TO_PAGE_UUID)
        };
        const PAGE_UUID_TO_PAGE_TITLE = {};
        const titles = [];
        const uuids = [];

        let redirected = false;
        Object.keys(PAGE_TITLE_TO_PAGE_UUID).forEach(title => {
            const uuid = PAGE_TITLE_TO_PAGE_UUID[title];
            titles.push(title);
            uuids.push(uuid);
            PAGE_UUID_TO_PAGE_TITLE[uuid] = title
        });

        function getPageUUID() {
            return location.pathname.slice( - 32)
        }

        function getPageUUIDTitle() {
            return location.pathname.slice(1)
        }

        function updatePageTitle() {
            const title = PAGE_UUID_TO_PAGE_TITLE[getPageUUID()];
            if (title != null) {
                history.replaceState(history.state, "", "/" + title)
            }
        }

        const observer = new MutationObserver(function() {
            if (redirected) return;
            const nav = document.querySelector(".notion-topbar");
            const mobileNav = document.querySelector(".notion-topbar-mobile");
            if (nav && nav.firstChild && nav.firstChild.firstChild || mobileNav && mobileNav.firstChild) {
                redirected = true;
                updatePageTitle();
                const onpopstate = window.onpopstate;
                window.onpopstate = function() {
                    if (titles.includes(getPageUUIDTitle())) {
                        const uuid = PAGE_TITLE_TO_PAGE_UUID[getPageUUIDTitle()];
                        if (uuid) {
                            history.replaceState(history.state, "bypass", "/" + uuid)
                        }
                    }
                    onpopstate.apply(this, [].slice.call(arguments));
                    updatePageTitle()
                }
            }
        });

        observer.observe(document.querySelector("#notion-app"), {
            childList: true,
            subtree: true,
        });

        const replaceState = window.history.replaceState;
        window.history.replaceState = function(state) {
            if (arguments[1] !== "bypass" && titles.includes(getPageUUIDTitle())) return;
            return replaceState.apply(window.history, arguments)
        };

        const pushState = window.history.pushState;
        window.history.pushState = function(state) {
            const dest = new URL(location.protocol + location.host + arguments[2]);
            const id = dest.pathname.slice( - 32);
            if (uuids.includes(id)) {
                arguments[2] = "/" + PAGE_UUID_TO_PAGE_TITLE[id]
            }
            return pushState.apply(window.history, arguments)
        };

        const open = window.XMLHttpRequest.prototype.open;
        window.XMLHttpRequest.prototype.open = function() {
            arguments[1] = arguments[1].replace("${DOMAIN}", "${NOTION_SITE}");
            return open.apply(this, [].slice.call(arguments))
        };
        </script>
        `,
            {
                html: true,
            }
        );
    }
}

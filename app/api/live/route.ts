// GET /api/live?url=...  → the web page itself, served from Tack so the preview can follow your clicks.
//
// Why: a site shown in a normal frame hides which page you're on (browser security), so Reader,
// Images and Add link couldn't follow you. Here we fetch the page, point its links/images back at the
// real site (<base href>), and add a small script that tells Tack when you click to another page.
//
// Safety: the page runs in a sandbox with no access to Tack (the CSP "sandbox" header applies even if
// someone opens this URL directly), so its scripts can't read Tack's storage, cookies or keys.

import { isSafePublicUrl } from "@/lib/web";

export const runtime = "nodejs";
export const maxDuration = 30;

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

const SANDBOX = "sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

// Runs first inside the page. Kept small and defensive: if anything fails, the page still shows.
function helper(pageUrl: string) {
  return `<script>(function(){
var PAGE=${JSON.stringify(pageUrl)};
function tell(m){try{m.source="tack-live";parent.postMessage(m,"*")}catch(e){}}
// the sandbox has no storage or cookies; give scripts harmless stand-ins so they don't crash
function mem(){var d={};return{getItem:function(k){return k in d?d[k]:null},setItem:function(k,v){d[k]=String(v)},removeItem:function(k){delete d[k]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}}}
try{window.localStorage}catch(e){try{Object.defineProperty(window,"localStorage",{value:mem()})}catch(e2){}}
try{window.sessionStorage}catch(e){try{Object.defineProperty(window,"sessionStorage",{value:mem()})}catch(e2){}}
try{document.cookie}catch(e){try{var jar="";Object.defineProperty(document,"cookie",{get:function(){return jar},set:function(v){jar=String(v).split(";")[0]}})}catch(e2){}}
function abs(h){try{return new URL(h,document.baseURI).href}catch(e){return null}}
function samePage(u){try{var a=new URL(u),b=new URL(PAGE);return a.origin===b.origin&&a.pathname===b.pathname&&a.search===b.search}catch(e){return false}}
// link clicks: ask Tack to open the page (so Reader etc. follow)
document.addEventListener("click",function(e){
  if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
  var a=e.target&&e.target.closest&&e.target.closest("a[href]");if(!a)return;
  var t=(a.getAttribute("target")||"").toLowerCase();if(t&&t!=="_self"&&t!=="_top"&&t!=="_parent")return;
  if(a.hasAttribute("download"))return;
  var u=abs(a.getAttribute("href"));if(!u||!/^https?:/.test(u))return;
  e.preventDefault();
  if(samePage(u)){var h=decodeURIComponent(new URL(u).hash.slice(1));var el=h&&(document.getElementById(h)||document.getElementsByName(h)[0]);if(el)el.scrollIntoView({behavior:"smooth"});else if(!h)window.scrollTo(0,0);return}
  tell({type:"navigate",url:u});
},false);
// search boxes and other GET forms
document.addEventListener("submit",function(e){
  var f=e.target;if(!f||(f.method||"get").toLowerCase()!=="get")return;
  var u=abs(f.getAttribute("action")||PAGE);if(!u)return;
  e.preventDefault();var x=new URL(u);x.search=new URLSearchParams(new FormData(f)).toString();
  tell({type:"navigate",url:x.href});
},false);
// sites that change pages without reloading (pushState): report the new address
["pushState","replaceState"].forEach(function(k){var o=history[k];history[k]=function(s,t,u){
  if(u!=null){var n=abs(u);if(n&&k==="pushState")tell({type:"page",url:n});try{return o.call(history,s,t)}catch(e){}}
  try{return o.apply(history,arguments)}catch(e){}
}});
tell({type:"ready",url:PAGE});
})();</script>`;
}

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("url") || "";
  const page = (body: string, status = 200) =>
    new Response(body, {
      status,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "content-security-policy": SANDBOX,
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
        "cache-control": "private, max-age=60",
      },
    });
  const message = (text: string) =>
    page(`<!doctype html><meta charset="utf-8"><body style="font:14px system-ui;color:#555;padding:24px;line-height:1.5">${esc(text)}</body>`);

  if (!isSafePublicUrl(url)) return message("That link can’t be opened.");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const get = (u: string) => fetch(u, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "user-agent": BROWSER_UA, accept: "text/html,application/xhtml+xml,*/*;q=0.8", "accept-language": "en-US,en;q=0.9" },
    });
    // Tack is served over https, and a secure page can't load styles or scripts from a plain http site.
    // So for http:// links, try the https version of the site first and fall back to http.
    let res: Response;
    if (/^http:\/\//i.test(url)) {
      try { res = await get(url.replace(/^http:/i, "https:")); if (!res.ok) throw new Error(); }
      catch (e) { if ((e as Error)?.name === "AbortError") throw e; res = await get(url); }
    } else res = await get(url);
    const finalUrl = res.url || url;
    if (!isSafePublicUrl(finalUrl)) return message("That link can’t be opened.");
    const type = res.headers.get("content-type") || "";
    if (type.startsWith("image/")) {
      return page(`<!doctype html><meta charset="utf-8"><body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#f4f4f4"><img src="${esc(finalUrl)}" style="max-width:100%;max-height:100vh" referrerpolicy="no-referrer"></body>`);
    }
    if (!type.includes("html")) return message("This link isn’t a web page. Use “Open” to see it in your browser.");
    let html = await res.text();
    if (html.length > 5_000_000) html = html.slice(0, 5_000_000);

    // drop the page's own <base> and CSP meta tags (ours must win), then add ours first in <head>
    html = html
      .replace(/<base\b[^>]*>/gi, "")
      .replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, "");
    // upgrade-insecure-requests: any http:// image, style or script the page asks for is fetched over https instead of being blocked
    const inject = `<meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests"><base href="${esc(finalUrl)}">${helper(finalUrl)}`;
    if (/<head\b[^>]*>/i.test(html)) html = html.replace(/<head\b[^>]*>/i, (m) => m + inject);
    else if (/<html\b[^>]*>/i.test(html)) html = html.replace(/<html\b[^>]*>/i, (m) => m + "<head>" + inject + "</head>");
    else html = inject + html;
    return page(html);
  } catch (e: any) {
    return message(e?.name === "AbortError" ? "That page took too long to load." : "Couldn’t load this page. Try “Original” or open it in your browser.");
  } finally {
    clearTimeout(timer);
  }
}

"""IPv6 Website & Dependency Readiness Auditor – FastAPI backend."""

import socket
from urllib.parse import urlparse

import dns.resolver
import httpx
from bs4 import BeautifulSoup
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="IPv6 Readiness Auditor")

# Allow any origin so browsers can call the API directly
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def clean_domain(raw: str) -> str:
    """Strip scheme, path, and port – return bare hostname."""
    raw = raw.strip().strip("/")
    if not raw.startswith(("http://", "https://")):
        raw = "https://" + raw          # add scheme so urlparse works
    parsed = urlparse(raw)
    return parsed.hostname or raw       # hostname is lowercase already


def has_aaaa(host: str) -> bool:
    """Return True if the host has at least one AAAA (IPv6) DNS record."""
    try:
        dns.resolver.resolve(host, "AAAA")
        return True
    except Exception:
        return False


def is_reachable_ipv6(host: str, port: int = 443, timeout: float = 5.0) -> bool:
    """Try a TCP connect to *host* on *port* over IPv6."""
    try:
        # Resolve to an IPv6 address first
        infos = socket.getaddrinfo(host, port, socket.AF_INET6, socket.SOCK_STREAM)
        for family, stype, proto, _, addr in infos:
            with socket.socket(family, stype, proto) as s:
                s.settimeout(timeout)
                s.connect(addr)
                return True             # first successful connection is enough
    except Exception:
        pass
    return False


def extract_dependency_hosts(html: str, main_domain: str) -> list[str]:
    """Parse HTML and return up to 15 unique third-party hostnames."""
    soup = BeautifulSoup(html, "html.parser")
    hosts: set[str] = set()

    # Tags and attributes that reference external resources
    selectors = [
        ("script", "src"),
        ("link",   "href"),
        ("img",    "src"),
        ("iframe", "src"),
    ]

    for tag_name, attr in selectors:
        for tag in soup.find_all(tag_name, **{attr: True}):
            url = tag[attr]
            if not url.startswith(("http://", "https://")):
                continue                # skip relative / data URIs
            parsed = urlparse(url)
            host = parsed.hostname
            if host and host != main_domain and not host.endswith("." + main_domain):
                hosts.add(host)
            if len(hosts) >= 15:        # cap early to save time
                break
        if len(hosts) >= 15:
            break

    return sorted(hosts)[:15]


def compute_score(dns_ipv6: bool, reachable_ipv6: bool,
                  deps: list[dict]) -> int:
    """Calculate readiness score out of 100."""
    score = 0
    if dns_ipv6:
        score += 20                     # 20 pts for AAAA record
    if reachable_ipv6:
        score += 30                     # 30 pts for reachability

    # Up to 50 pts based on dependency IPv6 share
    if not deps:
        score += 50                     # no deps → full marks
    else:
        ipv6_count = sum(1 for d in deps if d["ipv6"])
        score += int(50 * ipv6_count / len(deps))

    return score


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@app.get("/scan")
async def scan(url: str = Query(..., description="Domain or URL to audit")):
    """Audit a website's IPv6 readiness and return a JSON report."""
    domain = clean_domain(url)

    # 1. DNS AAAA check
    dns_ipv6 = has_aaaa(domain)

    # 2. IPv6 TCP reachability (only if AAAA exists)
    reachable_ipv6 = is_reachable_ipv6(domain) if dns_ipv6 else False

    # 3. Fetch page and extract third-party dependency hosts
    dep_hosts: list[str] = []
    try:
        async with httpx.AsyncClient(
            timeout=10.0, follow_redirects=True, verify=False
        ) as client:
            resp = await client.get(f"https://{domain}")
            dep_hosts = extract_dependency_hosts(resp.text, domain)
    except Exception:
        pass  # page unreachable → empty dependency list

    # 4. Check each dependency for AAAA records
    dependencies = [{"host": h, "ipv6": has_aaaa(h)} for h in dep_hosts]

    # 5. Score
    score = compute_score(dns_ipv6, reachable_ipv6, dependencies)

    return {
        "site": domain,
        "score": score,
        "dns_ipv6": dns_ipv6,
        "reachable_ipv6": reachable_ipv6,
        "dependencies": dependencies,
    }

# IPv6 Website & Dependency Readiness Auditor

A lightweight FastAPI backend that checks whether a website and its third-party dependencies are reachable over IPv6.

## Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload --port 8000
```

## Usage

Send a GET request to the `/scan` endpoint with a `url` query parameter:

```
GET http://localhost:8000/scan?url=example.com
```

The response is a JSON object with:

| Field            | Description                                         |
|------------------|-----------------------------------------------------|
| `site`           | The cleaned domain name                             |
| `score`          | IPv6 readiness score out of 100                     |
| `dns_ipv6`       | Whether the domain has an AAAA record               |
| `reachable_ipv6` | Whether port 443 is reachable over IPv6             |
| `dependencies`   | List of third-party hosts and their IPv6 support    |

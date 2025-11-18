# Jetstream API Research - Author Handle Extraction

## Key Finding: Identity Events Contain Handles

Based on the official Jetstream documentation, **author handles are NOT in commit events**. Instead, they come through **identity events**.

### Event Structure

**Commit Event** (does NOT include handle):
```json
{
  "did": "did:plc:eygmaihciaxprqvxpfvl6flk",
  "time_us": 1725911162329308,
  "kind": "commit",
  "commit": {
    "rev": "3l3qo2vutsw2b",
    "operation": "create",
    "collection": "app.bsky.feed.like",
    "rkey": "3l3qo2vuowo2b",
    "record": { ... }
  }
}
```

**Identity Event** (DOES include handle):
```json
{
  "did": "did:plc:ufbl4k27gp6kzas5glhz7fim",
  "time_us": 1725516665234703,
  "kind": "identity",
  "identity": {
    "did": "did:plc:ufbl4k27gp6kzas5glhz7fim",
    "handle": "yohenrique.bsky.social",
    "seq": 1409752997,
    "time": "2024-09-05T06:11:04.870Z"
  }
}
```

## Solution

We need to:
1. **Listen for identity events** and build a DID → handle mapping cache
2. **Store the mapping** in memory (Map/Object)
3. **Look up handles** when displaying posts using the author DID

### Implementation Strategy

1. Add identity event listener in firehose service
2. Maintain a `Map<DID, Handle>` cache
3. When emitting posts, include the cached handle for that DID
4. Handle cases where handle is not yet cached (show DID as fallback)

## Official Documentation

- GitHub: https://github.com/bluesky-social/jetstream
- Docs: https://docs.bsky.app/blog/jetstream
- Public instances: wss://jetstream2.us-east.bsky.network/subscribe

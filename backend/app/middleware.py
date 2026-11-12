"""Bound the entire request before multipart parsing can spool it to disk."""
from starlette.responses import JSONResponse


class RequestLimits:
    def __init__(self, app, limit):
        self.app = app
        self.limit = limit

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        async def secure_send(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.extend([(b"x-content-type-options", b"nosniff"), (b"cache-control", b"no-store")])
                message = {**message, "headers": headers}
            await send(message)

        async def reject():
            await JSONResponse(status_code=413, content={"detail": "Request exceeds the 10 MiB file upload limit."})(scope, receive, secure_send)

        if scope["method"] not in ("POST", "PUT", "PATCH"):
            return await self.app(scope, receive, secure_send)
        length = dict(scope["headers"]).get(b"content-length")
        if length and (not length.isdigit() or int(length) > self.limit):
            return await reject()
        # Local prototype: bounded in-memory body (10 MiB + multipart overhead),
        # then replay it to the parser. Chunked bodies receive the same bound.
        chunks = []
        size = 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            size += len(chunk)
            if size > self.limit:
                return await reject()
            chunks.append(chunk)
            if not message.get("more_body", False):
                break
        body = b"".join(chunks)
        del chunks
        delivered = False

        async def replay():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()

        await self.app(scope, replay, secure_send)

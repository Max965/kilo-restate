#!/usr/bin/env python3
"""Run one child with a POSIX controlling TTY and bridge its bytes to stdio."""
import errno
import fcntl
import json
import os
import pty
import select
import signal
import struct
import sys
import termios


def write_all(fd, data):
    view = memoryview(data)
    while view:
        written = os.write(fd, view)
        view = view[written:]


if len(sys.argv) < 2:
    raise SystemExit("usage: pty-bridge.py executable [args...]")

resize_fd = None
try:
    os.fstat(3)
    resize_fd = 3
except OSError:
    pass
size = {"rows": 24, "columns": 80}
if resize_fd is not None:
    initial = bytearray()
    while not initial.endswith(b"\n"):
        chunk = os.read(resize_fd, 1)
        if not chunk:
            break
        initial.extend(chunk)
    if initial:
        size = json.loads(initial)

pid, master = pty.fork()
if pid == 0:
    if resize_fd is not None:
        os.close(resize_fd)
    os.environ.setdefault("TERM", "xterm-256color")
    os.execvpe(sys.argv[1], sys.argv[1:], os.environ)

fcntl_size = struct.pack("HHHH", size['rows'], size['columns'], 0, 0)
try:
    fcntl.ioctl(master, termios.TIOCSWINSZ, fcntl_size)
except OSError:
    pass

stdin_open = True

def forward_signal(signum, _frame):
    try:
        os.killpg(pid, signum)
    except ProcessLookupError:
        pass


signal.signal(signal.SIGTERM, forward_signal)
signal.signal(signal.SIGHUP, forward_signal)
os.write(2, (json.dumps({"type": "pty_ready", "piPid": pid}) + "\n").encode())
status = None
resize_buffer = b""
try:
    while status is None:
        try:
            readable, _, _ = select.select([master] + ([0] if stdin_open else []) + ([resize_fd] if resize_fd is not None else []), [], [], 0.2)
        except InterruptedError:
            continue
        if resize_fd is not None and resize_fd in readable:
            chunk = os.read(resize_fd, 4096)
            if not chunk:
                resize_fd = None
            else:
                resize_buffer += chunk
                while b"\n" in resize_buffer:
                    line, resize_buffer = resize_buffer.split(b"\n", 1)
                    size = json.loads(line)
                    fcntl.ioctl(master, termios.TIOCSWINSZ, struct.pack("HHHH", size['rows'], size['columns'], 0, 0))
        if 0 in readable:
            try:
                data = os.read(0, 65536)
            except OSError as error:
                if error.errno in (errno.EIO, errno.EBADF):
                    data = b""
                else:
                    raise
            if not data:
                stdin_open = False
                forward_signal(signal.SIGHUP, None)
            else:
                write_all(master, data)
        if master in readable:
            try:
                data = os.read(master, 65536)
            except OSError as error:
                if error.errno == errno.EIO:
                    data = b""
                else:
                    raise
            if data:
                write_all(1, data)
        waited, child_status = os.waitpid(pid, os.WNOHANG)
        if waited:
            status = child_status
    if not os.WIFEXITED(status):
        raise SystemExit(128 + os.WTERMSIG(status))
    raise SystemExit(os.WEXITSTATUS(status))
finally:
    try:
        os.close(master)
    except OSError:
        pass
    if status is None:
        try:
            os.killpg(pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            os.waitpid(pid, 0)
        except ChildProcessError:
            pass

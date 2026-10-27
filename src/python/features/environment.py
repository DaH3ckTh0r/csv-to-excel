"""behave hooks: give every scenario its own temporary directory."""

import shutil
import tempfile


def before_scenario(context, scenario):
    context.dir = tempfile.mkdtemp(prefix="csv2xlsx-bdd-")
    context.workbooks = {}


def after_scenario(context, scenario):
    shutil.rmtree(context.dir, ignore_errors=True)

# handoff/

Design specifications handed to implementation.

`Mycelia.zip` contains the TUI design package: a full design brief, an HTML/React
visual prototype, and design tokens. The prototype is a *reference*, not the
implementation — mycelia's TUI runs in a terminal.

Extract with `python3 -c "import zipfile;zipfile.ZipFile('Mycelia.zip').extractall('extracted')"`.
The `extracted/` directory is gitignored; the zip is the committed artifact.

Referenced but not yet written: `CHARTER.md`, covering system intent and the
daemon architecture the TUI talks to.

# Maxyo66 portfolio

Live at https://maxyo66.github.io

`index.html` is built from the design source `tools/Main.dc.html` (the same file the Claude version of the portfolio runs) with `tools/build.js`:

```
npm i preact@10 htmlparser2
node tools/build.js tools/Main.dc.html . tools/assets.json
```

Images, video and sound live in `assets/`. Music and chimes by a friend of Max's.

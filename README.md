# babblebee
# babblebee

1. Install Deno [https://docs.deno.com/runtime/#install-deno](https://docs.deno.com/runtime/#install-deno)

2. Install and run LibreTranslate: [https://github.com/LibreTranslate/LibreTranslate?tab=readme-ov-file#install-and-run](https://github.com/LibreTranslate/LibreTranslate?tab=readme-ov-file#install-and-run) on port 5001, e.g. 

```
libretranslate --load-only en,es,fr --port 5001
```

3. Run

```
deno run --watch --allow-net --allow-env main.ts
```


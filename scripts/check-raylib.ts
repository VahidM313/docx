async function test() {
  const html = await (await fetch('https://www.raylib.com')).text();
  const icons = html.match(/<link[^>]*icon[^>]*>/gi);
  console.log('Raylib icons:', icons);
  const images = html.match(/<img[^>]*logo[^>]*>/gi);
  console.log('Raylib logo images:', images);
}
test();

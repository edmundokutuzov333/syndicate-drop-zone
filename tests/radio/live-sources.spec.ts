import { test, expect } from "@playwright/test";

const RADIO_SOURCES = [
  "https://cdn.discordapp.com/attachments/1313921250678014022/1557765898171842621/A_BAG_Complete.mp3?ex=6ac8fe0c&is=6ac7ac8c&hm=1494126ae70966427cf777eb721772f3d4ef00814f3b7412937c89cf1b266b14&",
  "https://cdn.discordapp.com/attachments/1313921250678014022/1557765662632575076/CHOPPER_1.mp3?ex=6ac8fdd3&is=6ac7ac53&hm=24be6c48e7ed9407277b217d90625b7208763f014fde12da7a6cdb4f2298cef4&",
  "https://cdn.discordapp.com/attachments/1313921250678014022/1557765539441410178/FREESTYLE_SUJO.mp3?ex=6ac8fdb6&is=6ac7ac36&hm=1505bde309c1d01f5fe53938aa22637dac8accffce29b90fb90a63c94fa55c42&",
  "https://cdn.discordapp.com/attachments/1313921250678014022/1557765583716614184/IM_FLEXIN_UP-KHRIYS_FT_GOMONEY.mp3?ex=6ac8fdc1&is=6ac7ac41&hm=5b7ee0a19fb3207d340c10bea0ebc551b0937b66a6de1cf8cf0f9cbaf58c9179&",
  "https://cdn.discordapp.com/attachments/1313921250678014022/1557765540070559885/MONEY_TALK_2.1_MELHOR_QUALIDADE.mp3?ex=6ac8fdb6&is=6ac7ac36&hm=ff97f95b66b387da151f5fcc10e5a2d8767569ff4d8861632469148e7a50d148&",
  "https://cdn.discordapp.com/attachments/1313921250678014022/1557765342690942986/TSANTO_DOUGH_1.mp3?ex=6ac8fd87&is=6ac7ac07&hm=9e02b411d4a7d54858462fcf40b4940708052c51b51ac2e01c5857200c5c6f71&",
  "https://cdn.discordapp.com/attachments/1313921250678014022/1557766706838114324/Unmastered_PHANTOM_Kingston_Siriro_Elton_Penicela_-_Fashion_de_Phantom.mp3?ex=6ac8fecc&is=6ac7ad4c&hm=9c70066a9c203dbb469d1cf40fa26b3f2eeb987c45fff12942eefbc1f83741d1&",
  "https://cdn.discordapp.com/attachments/1313921250678014022/1557766760034345020/Phantom_Bruno_The_Goat_Alemao_Wav__Elton_Penicela_-_A_Nova_Wave.mp3?ex=6ac8fed9&is=6ac7ad59&hm=65d0da1218a5d5b655ff7a83b3e8658942e24fde6dbd0817f36b9a36ae475be4&",
  "https://cdn.discordapp.com/attachments/1313921250678014022/1557766742204223548/PHANTOM_Mode_2_-_The_Final_Movie_W__INF8M8US_HEYYG_KINGSTON_SIRIRO.mp3?ex=6ac8fed5&is=6ac7ad55&hm=2359055ed92ca9baa8799a4abeaf9ec0bb9295072b4883b658a86c581705f89a&",
];

test("verifies every supplied Frequencia 808 source is reachable as audio", async ({ request }) => {
  for (const source of RADIO_SOURCES) {
    const response = await request.fetch(source, {
      method: "GET",
      headers: {
        Range: "bytes=0-65535",
        Accept: "audio/mpeg,audio/wav,*/*;q=0.1",
      },
      timeout: 20_000,
    });

    expect([200, 206], source).toContain(response.status());

    const contentType = (response.headers()["content-type"] ?? "").toLowerCase();
    expect(contentType, source).toMatch(/audio\/(mpeg|wav)|application\/octet-stream/);

    const body = await response.body();
    expect(body.byteLength, source).toBeGreaterThan(44);
  }
});

/// <reference types="@kitajs/html/all-types.d.ts" />

import { file } from "bun";

export async function wrapWithRoot(children: string) {
  const root = await file("./index.html").text();
  return root.replace("{{slot}}", children);
}

export function ScrollBtn(previousUrl?: string, nextUrl?: string) {
  return (
    <div class="flex flex-row gap-2 my-2">
      <sl-button variant="default" size="small" hx-get={previousUrl}>
        <sl-icon slot="prefix" name="arrow-left-circle"></sl-icon>
        Previous
      </sl-button>

      <sl-button variant="primary" size="small" hx-get={nextUrl}>
        <sl-icon slot="suffix" name="arrow-right-circle"></sl-icon>
        Next
      </sl-button>
    </div>
  );
}

export function BlockedWordCard(words: string[]) {
  return (
    <sl-card class="card-header">
      <div slot="header">
        Copy All
        <sl-copy-button value={words.join(",")}></sl-copy-button>
      </div>
      <div class="text-pretty max-w-100" safe>
        {words.join(", ")}
      </div>
    </sl-card>
  );
}

export function BlockedWordSection(
  words: string[][],
  firstID: number,
  lastID: number
) {
  return (
    <div hx-target="this" hx-swap="outerHTML">
      <div class="mb-2 flex flex-col gap-2">
        <h1 class="font-bold text-4xl">Judol Wordings</h1>
        <p class="font-light">
          Here are some words that are highly likely associated with illegal
          online gambling (judol) websites. These words were extracted from
          YouTube comments made by registered channels. You can copy them from
          each section below and add them to your YouTube channel’s{" "}
          <span class="font-bold">Blocked Words</span> list under the Comment
          Moderation menu.{" "}
          <a
            href="https://support.google.com/youtube/answer/9483359?hl=en#zippy=%2Cblocked-words"
            target="_blank"
            rel="noopener noreferrer"
          >
            <sl-button variant="default" size="small">
              <sl-icon slot="prefix" name="link-45deg"></sl-icon>
              <sl-icon slot="suffix" name="box-arrow-up-right"></sl-icon>
              Click to learn how
            </sl-button>
          </a>
        </p>
        <p class="font-light">
          Berikut adalah beberapa kata yang sangat mungkin terkait dengan situs
          judi online ilegal (judol). Kata-kata ini diekstrak dari komentar
          YouTube yang dibuat oleh saluran terdaftar. Anda dapat menyalinnya
          dari setiap bagian di bawah ini dan menambahkannya ke daftar{" "}
          <span class="font-bold">Kata yang Diblokir</span> di saluran YouTube
          Anda, di bawah menu Moderasi Komentar.{" "}
          <a
            href="https://support.google.com/youtube/answer/9483359?hl=en#zippy=%2Cblocked-words"
            target="_blank"
            rel="noopener noreferrer"
          >
            <sl-button variant="default" size="small">
              <sl-icon slot="prefix" name="link-45deg"></sl-icon>
              <sl-icon slot="suffix" name="box-arrow-up-right"></sl-icon>
              Pelajari bagaimana
            </sl-button>
          </a>
        </p>
      </div>
      {ScrollBtn(
        `/judol/word/before/${firstID}`,
        `/judol/word/after/${lastID}`
      )}
      <div class="flex flex-col md:flex-row gap-4 flex-wrap">
        {words.map((word) => BlockedWordCard(word))}
      </div>
    </div>
  );
}

export function BlockedChannelItem(channel: string) {
  return (
    <sl-card class="card-header">
      <div class="flex flex-row gap-2">
        <p class="font-semibold" safe>
          {channel.split("http://www.youtube.com/")[1]}
        </p>
        <sl-copy-button value={channel}></sl-copy-button>
      </div>
    </sl-card>
  );
}

export function BlockedChannelSection(
  channels: string[][],
  firstID: number,
  lastID: number
) {
  return (
    <div hx-target="this" hx-swap="outerHTML">
      <div class="mb-2 flex flex-col gap-2">
        <h1 class="font-bold text-4xl">Judol Channels</h1>
        <p class="font-light">
          Below are some users responsible for posting judol-related comments
          using keywords from the previous section. For enhanced security, I
          strongly recommend blocking these users from your channel as well.
          However, due to YouTube's limitations, you cannot bulk insert them
          like before. You will need to manually copy each URL and add it to
          your own YT channel <span class="font-bold">Hidden Users</span>{" "}
          settings under the Comment Moderation menu.{" "}
          <a
            href="https://support.google.com/youtube/answer/9483359?hl=en#zippy=%2Chidden-users"
            target="_blank"
            rel="noopener noreferrer"
          >
            <sl-button variant="default" size="small">
              <sl-icon slot="prefix" name="link-45deg"></sl-icon>
              <sl-icon slot="suffix" name="box-arrow-up-right"></sl-icon>
              Click to learn how
            </sl-button>
          </a>
        </p>
        <p class="font-light">
          Berikut adalah beberapa pengguna yang bertanggung jawab atas komentar
          terkait judol yang menggunakan kata kunci dari bagian sebelumnya.
          Untuk keamanan tambahan, saya sangat menyarankan Anda memblokir
          pengguna ini dari saluran Anda. Namun, karena keterbatasan YouTube,
          Anda tidak dapat memasukkannya secara massal seperti sebelumnya. Anda
          harus menyalin setiap URL secara manual dan menambahkannya ke
          pengaturan <span class="font-bold">Pengguna Tersembunyi</span> di
          saluran YouTube Anda di bawah menu Moderasi Komentar.{" "}
          <a
            href="https://support.google.com/youtube/answer/9483359?hl=id#zippy=%2Chidden-users"
            target="_blank"
            rel="noopener noreferrer"
          >
            <sl-button variant="default" size="small">
              <sl-icon slot="prefix" name="link-45deg"></sl-icon>
              <sl-icon slot="suffix" name="box-arrow-up-right"></sl-icon>
              Pelajari bagaimana
            </sl-button>
          </a>
        </p>
      </div>
      {ScrollBtn(
        `/judol/channel/before/${firstID}`,
        `/judol/channel/after/${lastID}`
      )}
      <div class="flex flex-row gap-4 flex-wrap">
        {channels.map((channel) =>
          channel.map((chl) => BlockedChannelItem(chl))
        )}
      </div>
    </div>
  );
}

export function Judol(
  blockedWords: string[][],
  blockedWordFirstID: number,
  blockedWordLastID: number,
  blockedChannels: string[][],
  blockedChannelFirstID: number,
  blockedChannelLastID: number
) {
  return (
    <div class="flex flex-col gap-8">
      {BlockedWordSection(blockedWords, blockedWordFirstID, blockedWordLastID)}
      {BlockedChannelSection(
        blockedChannels,
        blockedChannelFirstID,
        blockedChannelLastID
      )}
    </div>
  );
}

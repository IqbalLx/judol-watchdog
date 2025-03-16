/// <reference types="@kitajs/html/all-types.d.ts" />

import { file } from "bun";

export async function wrapWithRoot(children: string) {
  const root = await file("./index.html").text();
  return root.replace("{{slot}}", children);
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

export function BlockedWordSection(words: string[][]) {
  return (
    <>
      <div class="mb-2">
        <h1 class="font-bold text-4xl mb-2">Judol Wordings</h1>
        <p class="font-light">
          Below is some words that's highly possible an illegal online-gamble
          (judol) website, extracted from YT comments from registered Channels,
          you can copy from each section below and add to your own YT channel{" "}
          <span class="font-bold">Blocked Words</span> settings under Comment
          Moderation menu.{" "}
          <a
            href="https://support.google.com/youtube/answer/9483359?hl=en#zippy=%2Cblocked-words"
            target="_blank"
            rel="noopener noreferrer"
          >
            Click to learn more
          </a>
        </p>
      </div>
      <div class="flex flex-col md:flex-row gap-4 flex-wrap">
        {words.map((word) => BlockedWordCard(word))}
      </div>
    </>
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

export function BlockedChannelSection(words: string[][]) {
  return (
    <>
      <div class="mb-2">
        <h1 class="font-bold text-4xl mb-2">Judol Channels</h1>
        <p class="font-light">
          Below is some users responsible for any judol comments that use
          keywords from previous section. For extra security I really recommend
          to block this users from your channel too, but due to YT limitation,
          here you can't bulk insert it like before, you need to manually copy
          each URL and add to your own YT channel{" "}
          <span class="font-bold">Hidden Users</span> settings under Comment
          Moderation menu.{" "}
          <a
            href="https://support.google.com/youtube/answer/9483359?hl=en#zippy=%2Chidden-users"
            target="_blank"
            rel="noopener noreferrer"
          >
            Click to learn more
          </a>
        </p>
      </div>
      <div class="flex flex-row gap-4 flex-wrap">
        {words.map((word) =>
          word.map((channel) => BlockedChannelItem(channel))
        )}
      </div>
    </>
  );
}

export function Judol(blockedWords: string[][], blockedChannels: string[][]) {
  return (
    <div class="flex flex-col gap-8">
      {BlockedWordSection(blockedWords)}
      {BlockedChannelSection(blockedChannels)}
    </div>
  );
}

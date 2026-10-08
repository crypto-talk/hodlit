"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { discardImage, uploadImage } from "../api";
import { IMAGE_MAX, imageProblem } from "../limits";
import type { UploadedImage } from "../types";

export type ImageItem = {
  key: string;
  name: string;
  /** 업로드가 끝나기 전에도 보이도록 로컬 objectURL 을 쓴다. */
  preview: string;
  status: "uploading" | "done" | "error";
  image?: UploadedImage;
  error?: string;
  /**
   * 이미 글에 붙어 있던 이미지(수정 화면). 빼도 서버에서 바로 지우지 않는다 —
   * 수정을 저장하지 않고 나가면 원래 글에 그대로 있어야 한다. 저장하면 서버가 지운다.
   */
  existing?: boolean;
};

/** 수정 화면이 처음에 채우는 이미지. `src` 는 미리보기 주소다. */
export type InitialImage = { url: string; src: string };

/**
 * 글쓰기의 이미지 첨부 상태.
 *
 * 고르는 즉시 업로드를 시작한다. 업로드 중에도 글은 계속 쓸 수 있고 발행만
 * 잠긴다(와이어프레임). 실패한 항목은 목록에 남겨 이유를 보여주고, 발행에는
 * 업로드가 끝난 것만 실린다.
 */
export function useImageUploads(initial: InitialImage[] = []) {
  // 처음 한 번만 읽는다. 수정 화면은 글을 다 받은 뒤에 이 훅을 쓰는 컴포넌트를 그린다.
  const [items, setItems] = useState<ImageItem[]>(() =>
    initial.map((image) => ({
      key: image.url,
      name: image.url.split("/").pop() ?? "이미지",
      preview: image.src,
      status: "done",
      image: { url: image.url },
      existing: true,
    })),
  );
  const [notice, setNotice] = useState("");

  // 업로드 중에 빼 버린 항목. 업로드가 끝나면 서버에서도 지운다.
  const removed = useRef(new Set<string>());
  // 언마운트 때 objectURL 을 풀기 위해 최신 목록을 들고 있는다.
  const latest = useRef(items);
  useEffect(() => {
    latest.current = items;
  }, [items]);
  useEffect(
    () => () => {
      for (const item of latest.current) {
        if (!item.existing) URL.revokeObjectURL(item.preview);
      }
    },
    [],
  );

  const add = useCallback((files: Iterable<File>) => {
    const slots = IMAGE_MAX - latest.current.filter((item) => item.status !== "error").length;
    const accepted: ImageItem[] = [];
    const acceptedFiles: File[] = [];
    let message = "";

    for (const file of files) {
      const problem = imageProblem(file);
      if (problem) {
        message = `${file.name}: ${problem}`;
        continue;
      }
      if (accepted.length >= slots) {
        message = `이미지는 글당 ${IMAGE_MAX}장까지입니다.`;
        break;
      }
      accepted.push({
        key: crypto.randomUUID(),
        name: file.name,
        preview: URL.createObjectURL(file),
        status: "uploading",
      });
      acceptedFiles.push(file);
    }

    setNotice(message);
    if (accepted.length === 0) return;

    const update = (key: string, patch: Partial<ImageItem>) =>
      setItems((current) =>
        current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
      );
    setItems((current) => [...current, ...accepted]);

    accepted.forEach((item, index) => {
      uploadImage(acceptedFiles[index])
        .then((image) => {
          if (removed.current.has(item.key)) {
            void discardImage(image);
            return;
          }
          update(item.key, { status: "done", image });
        })
        .catch((reason: unknown) => {
          update(item.key, {
            status: "error",
            error: reason instanceof Error ? reason.message : "업로드하지 못했습니다.",
          });
        });
    });
  }, []);

  const remove = useCallback((key: string) => {
    const item = latest.current.find((candidate) => candidate.key === key);
    if (!item) return;
    if (!item.existing) URL.revokeObjectURL(item.preview);
    if (item.status === "uploading") removed.current.add(key);
    if (item.image && !item.existing) void discardImage(item.image);
    setItems((current) => current.filter((candidate) => candidate.key !== key));
  }, []);

  return {
    items,
    notice,
    add,
    remove,
    /** 발행에 실을 이미지. 올린 순서 그대로. */
    uploaded: items.flatMap((item) => (item.status === "done" && item.image ? [item.image] : [])),
    uploading: items.some((item) => item.status === "uploading"),
    full: items.filter((item) => item.status !== "error").length >= IMAGE_MAX,
  };
}

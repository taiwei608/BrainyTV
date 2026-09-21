const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const data = require(path.join(root, "stroke-data.js"));
const subsetPath = path.join(root, "assets", "strokes", "graphicsZhHant-subset.jsonl");
const [notice, ...raw] = fs.readFileSync(subsetPath, "utf8").trim().split(/\r?\n/).map(JSON.parse);
const meta = JSON.parse(fs.readFileSync(path.join(root, "assets", "strokes", "metadata.json"), "utf8"));
const lessons = [
  ["第一課：拍拍手", "拍手左右你他也上下"],
  ["第二課：這是誰的?", "這是誰的我分好了啊多個"],
  ["第三課：秋千", "秋千和玩高"],
];
const expected = lessons.flatMap(([sourceLesson, chars]) => [...chars].map((char) => ({ char, sourceLesson })));

test("selection is the documented 25 unique characters in lesson order", () => {
  assert.equal(expected.length, 25);
  assert.equal(new Set(expected.map(({ char }) => char)).size, 25);
  assert.deepEqual(data.characters.map(({ char, sourceLesson }) => ({ char, sourceLesson })), expected);
  assert.equal(raw.map(({ character }) => character).join(""), expected.map(({ char }) => char).join(""));
  assert.equal(meta.selection, expected.map(({ char }) => char).join(""));
  assert.match(meta.omitted["陪"], /Absent from graphicsZhHant\.txt/);
  assert.ok(!data.characters.some(({ char }) => char === "陪"));
});

test("every stroke has a path and a finite ordered median from the raw subset", () => {
  for (const [index, entry] of data.characters.entries()) {
    const source = raw[index];
    assert.deepEqual(entry.strokes, source.strokes, `${entry.char}: geometry changed`);
    assert.deepEqual(entry.medians, source.medians, `${entry.char}: medians changed`);
    assert.ok(entry.strokes.length > 0, `${entry.char}: no strokes`);
    assert.equal(entry.strokes.length, entry.medians.length, `${entry.char}: stroke/median mismatch`);
    for (const [strokeIndex, stroke] of entry.strokes.entries()) {
      assert.match(stroke, /^M\s*-?\d/, `${entry.char} stroke ${strokeIndex}: invalid path start`);
      assert.ok(entry.medians[strokeIndex].length >= 2, `${entry.char} stroke ${strokeIndex}: short median`);
      for (const point of entry.medians[strokeIndex]) {
        assert.equal(point.length, 2, `${entry.char}: point dimensions`);
        assert.ok(point.every(Number.isFinite), `${entry.char}: non-finite point`);
      }
    }
  }
});

test("generated and raw data carry modification and license notices", () => {
  const marker = notice._strokeSubsetNotice;
  assert.equal(marker.modified, "2026-09-22");
  assert.match(marker.how, /unchanged/);
  assert.match(marker.sourceCopyright, /AnimCJK 2016-2026 FM&SH; Arphic 1999/);
  assert.equal(marker.license, "Arphic Public License");
  for (const relative of [marker.licenseFile, marker.sourceNoticeFile]) {
    assert.ok(fs.statSync(path.join(root, relative)).size > 1000, `${relative}: missing or incomplete`);
  }
  const generated = fs.readFileSync(path.join(root, "stroke-data.js"), "utf8");
  assert.match(generated, /Modified 2026-09-22:.*path geometry and medians unchanged/);
  assert.match(generated, /Full license: assets\/strokes\/licenses\/ARPHICPL\.TXT/);
});

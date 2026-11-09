import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ReportReader from "../src/ReportReader";
import { newEntry } from "../src/model";
it("legacy title-only report displays a direct upload route instead of a fake readable summary", () => {
  const entry = { ...newEntry("report"), title: "11111" };
  const html = renderToStaticMarkup(
    <ReportReader
      entry={entry}
      onAttach={async () => {}}
      onEnlarge={() => {}}
    />,
  );
  expect(html).toContain("尚未上傳原始報告");
  expect(html).toContain("上傳原始報告並閱讀");
  expect(html).toContain("0 個附件");
  expect(html).not.toContain("整理摘要");
});
it("a saved image report is shown immediately without another preview click", () => {
  const entry = {
    ...newEntry("report"),
    title: "Report",
    attachments: [
      {
        id: "a",
        name: "report.png",
        type: "image/png",
        size: 1,
        data: "data:image/png;base64,AA==",
      },
    ],
  };
  const html = renderToStaticMarkup(
    <ReportReader
      entry={entry}
      onAttach={async () => {}}
      onEnlarge={() => {}}
    />,
  );
  expect(html).toContain("原始報告：report.png");
  expect(html).toContain('src="data:image/png;base64,AA=="');
  expect(html).not.toContain("尚未上傳原始報告");
});

"use client";

import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export async function exportElementToPDF(
  elementId: string,
  filename: string = "排产看板.pdf"
) {
  const element = document.getElementById(elementId);
  if (!element) {
    alert("找不到导出区域");
    return;
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      // 保证宽屏表格完整
      windowWidth: Math.max(element.scrollWidth, 1600),
    });

    const imgData = canvas.toDataURL("image/png");

    // 根据内容尺寸选择 A3 横向或自适应
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "a3",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const ratio = canvas.width / canvas.height;
    let imgWidth = pageWidth - 40;
    let imgHeight = imgWidth / ratio;

    if (imgHeight > pageHeight - 40) {
      imgHeight = pageHeight - 40;
      imgWidth = imgHeight * ratio;
    }

    const x = (pageWidth - imgWidth) / 2;
    const y = 20;

    pdf.addImage(imgData, "PNG", x, y, imgWidth, imgHeight);
    pdf.save(filename);
  } catch (e) {
    console.error(e);
    alert("PDF 导出失败: " + (e as Error).message);
  }
}

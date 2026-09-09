"use server";

export const getMenu = async () => {
  console.log("Fetching menu...");

  try {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    const response = await fetch(
      `https://welplan.pmh.codes/restaurants/welstory/REST000133/r5-b1f/${today}`,
      {
        headers: {
          Accept: "text/html"
        },
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();

    // 1. 모든 img 태그 탐색
    const imgTagRegex = /<img\b[^>]*>/gi;
    const results: { text: string; image: string }[] = [];
    let match;

    while ((match = imgTagRegex.exec(html)) !== null) {
      const imgTag = match[0];

      // 2. src 속성 추출
      const srcMatch = imgTag.match(/src=["']([^"']+)["']/i);
      const src = srcMatch ? srcMatch[1] : "";

      // 3. src에 'recipe'가 포함된 경우만 필터링
      if (src.includes("recipe")) {
        // 4. alt 속성 추출 (없으면 빈 문자열)
        const altMatch = imgTag.match(/alt=["']([^"']*)["']/i);
        const alt = altMatch ? altMatch[1].trim() : "";

        // HTML 엔티티 치환 (&amp;, &nbsp; 등)
        const cleanText = alt
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&nbsp;/g, " ");

        results.push({
          text: cleanText,
          image: src
        });
      }
    }

    return { status: "success", data: results };
  } catch (error) {
    console.error("Error fetching menu data:", error);
    return { status: "error", message: "Failed to fetch menu" };
  }
};

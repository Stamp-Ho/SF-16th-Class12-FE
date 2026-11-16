"use server";

const RESTAURANT_CODE = "REST000213";
const DEFAULT_MENU_IMAGE = "https://i.ytimg.com/vi/ritv9l9lJWs/mqdefault.jpg";

type WelstoryMeal = {
  menuCourseType?: string;
  subMenuTxt?: string;
  photoUrl?: string;
  photoCd?: string;
};

type WelstoryResponse = {
  data?: {
    mealList?: WelstoryMeal[];
  };
};

const getSeoulDate = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

  return `${values.year}${values.month}${values.day}`;
};

const getMealType = () => {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      hourCycle: "h23"
    })
      .formatToParts(new Date())
      .find(({ type }) => type === "hour")?.value
  );

  return hour >= 17
    ? { mealType: "3", courses: new Set(["AA", "BB", "CC"]) }
    : { mealType: "2", courses: new Set(["AA", "BB"]) };
};

export const getMenu = async () => {
  try {
    const { mealType, courses } = getMealType();
    const params = new URLSearchParams({
      menuDt: getSeoulDate(),
      menuMealType: mealType,
      restaurantCode: RESTAURANT_CODE
    });
    const rememberMe = process.env.WELSTORY_REMEMBER_ME;

    if (!rememberMe) {
      throw new Error("WELSTORY_REMEMBER_ME is not configured");
    }

    const response = await fetch(`https://welplus.welstory.com/api/meal?${params}`, {
      headers: {
        Accept: "application/json",
        Cookie: `remember-me=${rememberMe}`
      },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Welstory API returned HTTP ${response.status}`);
    }

    const responseBody = await response.text();
    if (!responseBody.trim()) {
      throw new Error(`Welstory API returned an empty body (HTTP ${response.status})`);
    }

    let result: WelstoryResponse;
    try {
      result = JSON.parse(responseBody) as WelstoryResponse;
    } catch {
      throw new Error("Welstory API returned a non-JSON response");
    }

    const mealList = result.data?.mealList;

    if (!Array.isArray(mealList)) {
      throw new Error("Welstory API response did not contain a meal list");
    }

    const data = mealList
      .filter((meal) => meal.menuCourseType && courses.has(meal.menuCourseType))
      .map((meal) => {
        const image = meal.photoUrl && meal.photoCd
          ? `${meal.photoUrl}${meal.photoCd}`
          : DEFAULT_MENU_IMAGE;

        return {
          text: meal.subMenuTxt?.trim() ?? "",
          image
        };
      });
    return { status: "success" as const, data };
  } catch (error) {
    console.error("Error fetching menu data:", error);
    return { status: "error" as const, message: "Failed to fetch menu" };
  }
};

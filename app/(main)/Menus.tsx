"use client";
import { useState, useEffect } from "react";
import { getMenu } from "../actions";
import { ExternalLink } from "lucide-react";
export default function Menus() {
  const [menuData, setMenuData] = useState<{ text: string; image?: string }[]>(
    []
  );

  useEffect(() => {
    getMenu()
      .then((data) => {
        if (data.status === "success") {
          setMenuData(data.data ?? []);
        }
      })
      .catch((error) => {
        console.error("Error fetching menu data:", error);
      });
  }, []);

  return (
    <div className="absolute left-1/2 -translate-x-1/2 z-2 top-2.5 w-max flex flex-wrap gap-2 hover:scale-300 hover:translate-x-10 hover:p-3 border-slate-200 hover:border-2 bg-white rounded-xl">
      {menuData.length === 0 && (
        <div className="text-sm text-slate-500">20층 메뉴 불러오는 중...</div>
      )}
      {menuData?.map((menu, index) => (
        <div key={index} className="flex flex-col items-center">
          <img
            key={index}
            src={menu.image ?? ""}
            alt={`Menu ${index}`}
            className="w-18 h-14 object-cover"
          />
          <p className="text-xs text-slate-500 z-3 -mt-1">{menu.text}</p>
        </div>
      ))}
    </div>
  );
}

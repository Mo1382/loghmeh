export const INGREDIENT_UNITS = [
  "به مقدار کافی",
  "عدد",
  "گرم",
  "کیلوگرم",
  "میلی‌گرم",
  "میلی‌لیتر",
  "لیتر",
  "قاشق غذاخوری",
  "قاشق چای‌خوری",
  "پیمانه",
  "لیوان",
  "فنجان",
  "حبه",
  "پر",
  "برش",
];

export const DIFFICULTIES = ["آسان", "متوسط", "سخت"];

// Account identity and access
export const ACCOUNT_STATUSES = ["ACTIVE", "SUSPENDED", "DEACTIVATED"];
export const USER_ROLES = ["USER", "ADMIN"];
export const USER_TITLES = [
  "USER",
  "COOK",
  "HEAD_CHEF",
  "BARISTA",
  "FOOD_BLOGGER",
];

// Authentication and verification
export const VERIFICATION_CODE_PURPOSES = {
  EMAIL_VERIFICATION: "EMAIL_VERIFICATION",
  PASSWORD_RESET: "PASSWORD_RESET",
};

// Community interactions
export const REACTION_TYPES = {
  LIKE: "LIKE",
  DISLIKE: "DISLIKE",
};

export const NOTIFICATION_TYPES = {
  RECIPE_RATED: "RECIPE_RATED",
  RECIPE_COMMENTED: "RECIPE_COMMENTED",
  COMMENT_REPLIED: "COMMENT_REPLIED",
  COMMENT_LIKED: "COMMENT_LIKED",
  COMMENT_DISLIKED: "COMMENT_DISLIKED",
  ANNOUNCEMENT: "ANNOUNCEMENT",
  SUPPORT_REPLIED: "SUPPORT_REPLIED",
};

// Support
export const TICKET_STATUSES = {
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED",
};

// List sorting and aggregate-statistic keys
export const RECIPE_SORTS = {
  NEWEST: "NEWEST",
  OLDEST: "OLDEST",
  MOST_VIEWED: "MOST_VIEWED",
  HIGHEST_RATED: "HIGHEST_RATED",
};

export const USER_SORTS = {
  HIGHEST_RATED: "HIGHEST_RATED",
  MOST_VIEWED: "MOST_VIEWED",
  NEWEST: "NEWEST",
  OLDEST: "OLDEST",
};

export const RECIPE_STATS = {
  VIEW_COUNT: "stats.viewCount",
  RATING_COUNT: "stats.ratingCount",
  COMMENT_COUNT: "stats.commentCount",
};

export const USER_STATS = {
  RECIPE_COUNT: "recipeCount",
  TOTAL_RECIPE_VIEWS: "totalRecipeViews",
};

export const COMMENT_STATS = {
  LIKE_COUNT: "likeCount",
  DISLIKE_COUNT: "dislikeCount",
};

export const FOLLOW_LIST_TYPES = {
  FOLLOWING: "FOLLOWING",
  FOLLOWERS: "FOLLOWERS",
};

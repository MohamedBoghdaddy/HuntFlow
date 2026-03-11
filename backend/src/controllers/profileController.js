import Profile from "../models/Profile.js";

const normalizeStringArray = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const normalizeBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
};

const emptyProfileShape = {
  title: "",
  seniority: "",
  locations: [],
  links: {
    portfolio: "",
    github: "",
    linkedin: "",
  },
  authorization: "",
  salaryExpectation: {
    amount: "",
    currency: "",
  },
  preferences: {
    roles: [],
    industries: [],
    companies: [],
    salary: "",
    remoteOnly: false,
    cities: [],
  },
};

export const getMyProfile = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const profile = await Profile.findOne({ userId });

    if (!profile) {
      return res.status(200).json({
        profile: emptyProfileShape,
      });
    }

    return res.status(200).json({
      profile,
    });
  } catch (error) {
    console.error("getMyProfile error:", error);
    return res.status(500).json({
      message: "Failed to fetch profile",
      error: error.message,
    });
  }
};

export const createOrUpdateProfile = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const {
      title,
      seniority,
      locations,
      links,
      authorization,
      salaryExpectation,
      preferences,
    } = req.body;

    const profileData = {
      userId,
      title: typeof title === "string" ? title.trim() : "",
      seniority: typeof seniority === "string" ? seniority.trim() : "",
      locations: normalizeStringArray(locations),
      links: {
        portfolio:
          typeof links?.portfolio === "string" ? links.portfolio.trim() : "",
        github: typeof links?.github === "string" ? links.github.trim() : "",
        linkedin:
          typeof links?.linkedin === "string" ? links.linkedin.trim() : "",
      },
      authorization:
        typeof authorization === "string" ? authorization.trim() : "",
      salaryExpectation: {
        amount:
          salaryExpectation?.amount !== undefined &&
          salaryExpectation?.amount !== null
            ? String(salaryExpectation.amount).trim()
            : "",
        currency:
          typeof salaryExpectation?.currency === "string"
            ? salaryExpectation.currency.trim()
            : "",
      },
      preferences: {
        roles: normalizeStringArray(preferences?.roles),
        industries: normalizeStringArray(preferences?.industries),
        companies: normalizeStringArray(preferences?.companies),
        salary:
          preferences?.salary !== undefined && preferences?.salary !== null
            ? String(preferences.salary).trim()
            : "",
        remoteOnly: normalizeBoolean(preferences?.remoteOnly),
        cities: normalizeStringArray(preferences?.cities),
      },
    };

    const profile = await Profile.findOneAndUpdate({ userId }, profileData, {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    });

    return res.status(200).json({
      message: "Profile saved successfully",
      profile,
    });
  } catch (error) {
    console.error("createOrUpdateProfile error:", error);
    return res.status(500).json({
      message: "Failed to save profile",
      error: error.message,
    });
  }
};

export const deleteMyProfile = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const deletedProfile = await Profile.findOneAndDelete({ userId });

    if (!deletedProfile) {
      return res.status(404).json({
        message: "Profile not found",
      });
    }

    return res.status(200).json({
      message: "Profile deleted successfully",
    });
  } catch (error) {
    console.error("deleteMyProfile error:", error);
    return res.status(500).json({
      message: "Failed to delete profile",
      error: error.message,
    });
  }
};

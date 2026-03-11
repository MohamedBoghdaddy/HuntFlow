import Profile from "../models/Profile.js";

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
      return res.status(404).json({
        message: "Profile not found",
      });
    }

    return res.status(200).json(profile);
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
      fullName,
      email,
      phone,
      location,
      targetRole,
      yearsOfExperience,
      skills,
      education,
      certifications,
      summary,
    } = req.body;

    const profileData = {
      userId,
      fullName: fullName?.trim?.() || "",
      email: email?.trim?.().toLowerCase?.() || "",
      phone: phone?.trim?.() || "",
      location: location?.trim?.() || "",
      targetRole: targetRole?.trim?.() || "",
      yearsOfExperience:
        yearsOfExperience !== undefined && yearsOfExperience !== null
          ? Number(yearsOfExperience)
          : 0,
      skills: Array.isArray(skills)
        ? skills.map((item) => String(item).trim()).filter(Boolean)
        : [],
      education: Array.isArray(education)
        ? education.map((item) => String(item).trim()).filter(Boolean)
        : [],
      certifications: Array.isArray(certifications)
        ? certifications.map((item) => String(item).trim()).filter(Boolean)
        : [],
      summary: summary?.trim?.() || "",
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

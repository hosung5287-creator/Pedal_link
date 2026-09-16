package com.example.demo.dto;

import com.example.demo.entity.User;
import lombok.Data;
import java.time.LocalDateTime;

@Data
public class UserProfileResponse {
    private Long id;
    private String name;
    private String email;
    private boolean locationShareEnabled;
    private String profileImageUrl;
    private String bio;
    private String bikeInfo;
    private String gender;
    private Integer age;
    private String region;
    private LocalDateTime createdAt;

    public static UserProfileResponse from(User user) {
        UserProfileResponse r = new UserProfileResponse();
        r.id = user.getId();
        r.name = user.getName();
        r.email = user.getEmail();
        r.locationShareEnabled = user.isLocationShareEnabled();
        r.profileImageUrl = user.getProfileImageUrl();
        r.bio = user.getBio();
        r.bikeInfo = user.getBikeInfo();
        r.gender = user.getGender();
        r.age = user.getAge();
        r.region = user.getRegion();
        r.createdAt = user.getCreatedAt();
        return r;
    }
}

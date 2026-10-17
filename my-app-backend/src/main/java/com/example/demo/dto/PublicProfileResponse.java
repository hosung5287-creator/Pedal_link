package com.example.demo.dto;

import com.example.demo.entity.User;
import lombok.Data;
import java.time.LocalDateTime;

// 다른 사용자에게 보여주는 공개 프로필 — 피드에서 작성자를 눌렀을 때 쓴다.
// UserProfileResponse(본인용)와 달리 이메일·위치 공유 설정·로그인 방식은 싣지 않는다.
// 근처 라이더 미리보기에서 이미 다른 사람에게 보여주는 정도(성별/나이/지역/자전거/소개)와 같은 기준이다.
@Data
public class PublicProfileResponse {
    private Long id;
    private String name;
    private String bio;
    private String bikeInfo;
    private String gender;
    private Integer age;
    private String region;
    private LocalDateTime createdAt;

    public static PublicProfileResponse from(User user) {
        PublicProfileResponse r = new PublicProfileResponse();
        r.id = user.getId();
        r.name = user.getName();
        r.bio = user.getBio();
        r.bikeInfo = user.getBikeInfo();
        r.gender = user.getGender();
        r.age = user.getAge();
        r.region = user.getRegion();
        r.createdAt = user.getCreatedAt();
        return r;
    }
}

package com.example.demo.Config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

// 시연 모드 (demo.enabled=true, 환경변수 DEMO_ENABLED) — 가상 라이더를 1초마다 움직이는 스케줄러를 켠다.
// 꺼져 있으면 이 설정·DemoService·DemoController 가 모두 만들어지지 않아 실제 서비스에는 아무 영향이 없다.
@Configuration
@EnableScheduling
@ConditionalOnProperty(prefix = "demo", name = "enabled", havingValue = "true")
public class DemoConfig {
}
